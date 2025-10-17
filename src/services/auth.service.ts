import authApiClient from '@/lib/auth-api-client';
import type {
  User,
  AuthTokens,
  LoginRequest,
  RegisterBankUserRequest,
  RegisterCustomerRequest,
} from '@/types/auth';
import config from '@/config';

export const authService = {
  async login(credentials: LoginRequest): Promise<{ user: User; tokens: AuthTokens }> {
    const response = await authApiClient.post('/api/v1/auth/login', credentials);
    const { user, accessToken, refreshToken, expiresIn } = response.data;

    // Store tokens
    localStorage.setItem(config.auth.tokenKey, accessToken);
    localStorage.setItem(config.auth.refreshTokenKey, refreshToken);
    localStorage.setItem(config.auth.userKey, JSON.stringify(user));

    // Store userId separately for API headers
    if (user.userId) {
      localStorage.setItem('userId', user.userId);
    }

    return {
      user,
      tokens: { accessToken, refreshToken, expiresIn },
    };
  },

  async registerBankUser(data: RegisterBankUserRequest): Promise<User> {
    const response = await authApiClient.post('/api/v1/auth/register/bank-user', data);
    return response.data;
  },

  async registerCustomer(data: RegisterCustomerRequest): Promise<User> {
    const response = await authApiClient.post('/api/v1/auth/register/customer', data);
    return response.data;
  },

  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const response = await authApiClient.post('/api/v1/auth/refresh', { refreshToken });
    const { accessToken, refreshToken: newRefreshToken, expiresIn } = response.data;

    localStorage.setItem(config.auth.tokenKey, accessToken);
    localStorage.setItem(config.auth.refreshTokenKey, newRefreshToken);

    return { accessToken, refreshToken: newRefreshToken, expiresIn };
  },

  async getCurrentUser(): Promise<User> {
    const response = await authApiClient.get('/api/v1/users/me');
    const user = response.data;
    localStorage.setItem(config.auth.userKey, JSON.stringify(user));

    // Store userId separately for API headers
    if (user.userId) {
      localStorage.setItem('userId', user.userId);
    }

    return user;
  },

  async logout(): Promise<void> {
    try {
      await authApiClient.post('/api/v1/auth/logout');
    } finally {
      localStorage.removeItem(config.auth.tokenKey);
      localStorage.removeItem(config.auth.refreshTokenKey);
      localStorage.removeItem(config.auth.userKey);
      localStorage.removeItem('userId');
    }
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await authApiClient.post('/api/v1/users/change-password', {
      oldPassword,
      newPassword,
    });
  },

  getStoredUser(): User | null {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem(config.auth.userKey);
    return userStr ? JSON.parse(userStr) : null;
  },

  getStoredTokens(): AuthTokens | null {
    if (typeof window === 'undefined') return null;
    const accessToken = localStorage.getItem(config.auth.tokenKey);
    const refreshToken = localStorage.getItem(config.auth.refreshTokenKey);

    if (!accessToken || !refreshToken) return null;

    return {
      accessToken,
      refreshToken,
      expiresIn: 0, // Will be refreshed
    };
  },

  isAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem(config.auth.tokenKey);
  },
};
