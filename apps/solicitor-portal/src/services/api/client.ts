import config from '@/config';

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined>;
}

class ApiClient {
  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(config.auth.tokenKey);
  }

  private getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(config.auth.refreshTokenKey);
  }

  private getUserId(): string | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(config.auth.userKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw).id;
    } catch {
      return null;
    }
  }

  private getBankId(): string | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(config.auth.userKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw).bankId;
    } catch {
      return null;
    }
  }

  private getFirmId(): string | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(config.auth.userKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw).firmId;
    } catch {
      return null;
    }
  }

  private async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;
    try {
      const res = await fetch(`${config.api.baseUrl}/api/solicitor/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      localStorage.setItem(config.auth.tokenKey, data.accessToken);
      localStorage.setItem(config.auth.refreshTokenKey, data.refreshToken);
      return true;
    } catch {
      return false;
    }
  }

  async request<T>(url: string, options: RequestOptions = {}): Promise<T> {
    const token = this.getAuthToken();
    const userId = this.getUserId();
    const bankId = this.getBankId();
    const firmId = this.getFirmId();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (userId) headers['X-User-Id'] = userId;
    if (bankId) headers['X-Bank-Id'] = bankId;
    if (firmId) headers['X-Firm-Id'] = firmId;

    let fullUrl = url.startsWith('http') ? url : `${config.api.baseUrl}${url}`;

    if (options.params) {
      const search = new URLSearchParams();
      Object.entries(options.params).forEach(([k, v]) => {
        if (v !== undefined) search.set(k, String(v));
      });
      const qs = search.toString();
      if (qs) fullUrl += (fullUrl.includes('?') ? '&' : '?') + qs;
    }

    let res = await fetch(fullUrl, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (res.status === 401) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        const newToken = this.getAuthToken();
        if (newToken) headers['Authorization'] = `Bearer ${newToken}`;
        res = await fetch(fullUrl, {
          method: options.method || 'GET',
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
        });
      } else {
        localStorage.removeItem(config.auth.tokenKey);
        localStorage.removeItem(config.auth.refreshTokenKey);
        localStorage.removeItem(config.auth.userKey);
        if (typeof window !== 'undefined') window.location.href = '/solicitor/login';
      }
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      throw { status: res.status, message: error.message || res.statusText };
    }

    if (res.status === 204) return undefined as T;
    return res.json();
  }

  get<T>(url: string, params?: Record<string, string | number | boolean | undefined>) {
    return this.request<T>(url, { method: 'GET', params });
  }

  post<T>(url: string, body?: unknown) {
    return this.request<T>(url, { method: 'POST', body });
  }

  put<T>(url: string, body?: unknown) {
    return this.request<T>(url, { method: 'PUT', body });
  }

  patch<T>(url: string, body?: unknown) {
    return this.request<T>(url, { method: 'PATCH', body });
  }

  delete<T>(url: string) {
    return this.request<T>(url, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
