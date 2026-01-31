// services/api/client.ts
import config from '@/config';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async getHeaders(): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Get user ID from localStorage or auth context
    if (typeof window !== 'undefined') {
      let userId = localStorage.getItem('userId');

      // If no userId in localStorage, try to get it from user data
      if (!userId) {
        const userDataStr = localStorage.getItem(config.auth.userKey);
        if (userDataStr) {
          try {
            const userData = JSON.parse(userDataStr);
            userId = userData.userId;
            // Store it for future use
            if (userId) {
              localStorage.setItem('userId', userId);
            }
          } catch (e) {
            console.error('Failed to parse user data:', e);
          }
        }
      }

      // Use the userId if found, otherwise use a default for development
      if (userId) {
        headers['X-User-Id'] = userId;
      } else {
        // Fallback for development/testing - use admin user ID from seed data
        console.warn('No userId found, using default admin user ID');
        headers['X-User-Id'] = '11111111-1111-1111-1111-111111111111'; // Default admin user from seed data
      }
    }

    // Add JWT token if available
    const token = this.getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private getAuthToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(config.auth.tokenKey);
    }
    return null;
  }

  private async refreshToken(): Promise<string | null> {
    if (typeof window === 'undefined') return null;

    const refreshToken = localStorage.getItem(config.auth.refreshTokenKey);
    if (!refreshToken) {
      console.warn('[ApiClient] No refresh token found');
      return null;
    }

    try {
      console.log('[ApiClient] Attempting to refresh token...');
      const response = await fetch(`${this.baseUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        console.error('[ApiClient] Token refresh failed with status:', response.status);
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      const newAccessToken = data.accessToken;
      const newRefreshToken = data.refreshToken;

      // Store new tokens
      localStorage.setItem(config.auth.tokenKey, newAccessToken);
      if (newRefreshToken) {
        localStorage.setItem(config.auth.refreshTokenKey, newRefreshToken);
      }

      console.log('[ApiClient] Token refreshed successfully');
      return newAccessToken;
    } catch (error) {
      // Refresh failed, clear tokens and redirect to login
      console.error('[ApiClient] Token refresh failed, logging out:', error);
      localStorage.removeItem(config.auth.tokenKey);
      localStorage.removeItem(config.auth.refreshTokenKey);
      localStorage.removeItem(config.auth.userKey);
      localStorage.removeItem('userId');

      // Redirect to login
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }

      return null;
    }
  }

  async get<T>(path: string, retryCount: number = 0): Promise<T> {
    const headers = await this.getHeaders();

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers,
    });

    // Handle 401 Unauthorized - try to refresh token
    if (response.status === 401 && retryCount === 0) {
      const newToken = await this.refreshToken();
      if (newToken) {
        // Retry the request with new token
        return this.get<T>(path, retryCount + 1);
      }
    }

    if (!response.ok) {
      await this.handleError(response);
    }

    return response.json();
  }

  async post<T>(path: string, data: any, retryCount: number = 0): Promise<T> {
    const headers = await this.getHeaders();

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    // Handle 401 Unauthorized - try to refresh token
    if (response.status === 401 && retryCount === 0) {
      const newToken = await this.refreshToken();
      if (newToken) {
        // Retry the request with new token
        return this.post<T>(path, data, retryCount + 1);
      }
    }

    if (!response.ok) {
      await this.handleError(response);
    }

    // Handle empty responses (204 No Content or empty body)
    const contentLength = response.headers.get('content-length');
    if (response.status === 204 || contentLength === '0') {
      return undefined as T;
    }

    // Try to parse JSON, return undefined if empty
    const text = await response.text();
    if (!text || text.trim() === '') {
      return undefined as T;
    }

    return JSON.parse(text) as T;
  }

  async put<T>(path: string, data: any, retryCount: number = 0): Promise<T> {
    const headers = await this.getHeaders();

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });

    // Handle 401 Unauthorized - try to refresh token
    if (response.status === 401 && retryCount === 0) {
      const newToken = await this.refreshToken();
      if (newToken) {
        // Retry the request with new token
        return this.put<T>(path, data, retryCount + 1);
      }
    }

    if (!response.ok) {
      await this.handleError(response);
    }

    return response.json();
  }

  async delete<T>(path: string, retryCount: number = 0): Promise<T> {
    const headers = await this.getHeaders();

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers,
    });

    // Handle 401 Unauthorized - try to refresh token
    if (response.status === 401 && retryCount === 0) {
      const newToken = await this.refreshToken();
      if (newToken) {
        // Retry the request with new token
        return this.delete<T>(path, retryCount + 1);
      }
    }

    if (!response.ok) {
      await this.handleError(response);
    }

    return response.json();
  }

  private async handleError(response: Response): Promise<never> {
    let errorMessage = 'An error occurred';
    let errorCode = 'UNKNOWN_ERROR';

    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
      errorCode = errorData.code || errorCode;
    } catch (e) {
      errorMessage = response.statusText || errorMessage;
    }

    const error: any = new Error(errorMessage);
    error.code = errorCode;
    error.status = response.status;

    throw error;
  }
}

export const apiClient = new ApiClient();
