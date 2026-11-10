import config from '@/config';

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** Multipart upload; the browser sets the Content-Type boundary itself. */
  form?: FormData;
  /**
   * Never run the 401 → refresh → retry cycle. Required for calls where a 401 means "wrong
   * password", so a failed attempt is not silently repeated.
   */
  noRefresh?: boolean;
}

export interface ApiError {
  status: number;
  message: string;
  /** Stable machine code from the BFF, when it sends one (e.g. REAUTH_FAILED). */
  code?: string;
}

/**
 * API client for BFF-Customer.
 * Handles auth token injection, automatic 401 token refresh, and error mapping.
 */
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
    return localStorage.getItem('user_id');
  }

  private async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const res = await fetch(`${config.api.baseUrl}/api/customer/auth/refresh`, {
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

    const headers: Record<string, string> = {
      ...(options.form ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    };
    const payload = options.form ?? (options.body ? JSON.stringify(options.body) : undefined);

    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (userId) headers['X-User-Id'] = userId;

    const fullUrl = url.startsWith('http') ? url : `${config.api.baseUrl}${url}`;

    let res = await fetch(fullUrl, {
      method: options.method || 'GET',
      headers,
      body: payload,
    });

    // Automatic token refresh on 401
    if (res.status === 401 && !options.noRefresh) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        const newToken = this.getAuthToken();
        if (newToken) headers['Authorization'] = `Bearer ${newToken}`;
        res = await fetch(fullUrl, {
          method: options.method || 'GET',
          headers,
          body: payload,
        });
      } else {
        // Refresh failed → force logout
        localStorage.removeItem(config.auth.tokenKey);
        localStorage.removeItem(config.auth.refreshTokenKey);
        localStorage.removeItem('user_id');
        localStorage.removeItem(config.auth.userKey);
        if (typeof window !== 'undefined') {
          window.location.href = '/portal/login';
        }
      }
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      const failure: ApiError = { status: res.status, message: error.message || res.statusText, code: error.code };
      throw failure;
    }

    if (res.status === 204) return undefined as T;

    const text = await res.text();
    if (!text || !text.trim()) return undefined as T;

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error('Response was not valid JSON');
    }
  }

  get<T>(url: string) {
    return this.request<T>(url, { method: 'GET' });
  }

  post<T>(url: string, body?: unknown) {
    return this.request<T>(url, { method: 'POST', body });
  }

  /** POST where a 401 is a business answer (wrong password) and must not trigger a token refresh. */
  postNoRefresh<T>(url: string, body?: unknown) {
    return this.request<T>(url, { method: 'POST', body, noRefresh: true });
  }

  postForm<T>(url: string, form: FormData) {
    return this.request<T>(url, { method: 'POST', form });
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
