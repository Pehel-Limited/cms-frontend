// services/api/client.ts

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
        const userDataStr = localStorage.getItem('user_data');
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
      return localStorage.getItem('authToken');
    }
    return null;
  }

  async get<T>(path: string): Promise<T> {
    const headers = await this.getHeaders();

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    return response.json();
  }

  async post<T>(path: string, data: any): Promise<T> {
    const headers = await this.getHeaders();

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    return response.json();
  }

  async put<T>(path: string, data: any): Promise<T> {
    const headers = await this.getHeaders();

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    return response.json();
  }

  async delete<T>(path: string): Promise<T> {
    const headers = await this.getHeaders();

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers,
    });

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
