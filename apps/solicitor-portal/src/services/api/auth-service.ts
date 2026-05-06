import { apiClient } from './client';

export const authService = {
  async login(email: string, password: string) {
    return apiClient.post<{
      accessToken: string;
      refreshToken: string;
      user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        userType: string;
        bankId: string;
        firmId?: string;
      };
    }>('/api/solicitor/auth/login', { email, password });
  },

  async logout() {
    const token = localStorage.getItem('sol_auth_token');
    if (token) {
      await apiClient.post('/api/solicitor/auth/logout').catch(() => {});
    }
  },

  async getMe() {
    return apiClient.get<{
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      userType: string;
      bankId: string;
      firmId?: string;
    }>('/api/solicitor/auth/me');
  },
};
