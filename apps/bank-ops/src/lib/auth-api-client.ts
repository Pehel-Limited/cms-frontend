import axios, { AxiosInstance } from 'axios';
import config from '@/config';

/**
 * Dedicated API client for Identity Service (Authentication)
 * Points directly to Identity Service on port 8082
 */
const authApiClient: AxiosInstance = axios.create({
  baseURL: config.api.identityServiceUrl,
  timeout: config.api.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add token for authenticated endpoints
authApiClient.interceptors.request.use(
  requestConfig => {
    // Add auth token if available (for endpoints like /users/me)
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem(config.auth.tokenKey);
      if (token && requestConfig.headers) {
        requestConfig.headers.Authorization = `Bearer ${token}`;
      }
    }
    return requestConfig;
  },
  error => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
authApiClient.interceptors.response.use(
  response => response,
  error => {
    // For auth client, we don't auto-refresh tokens (to avoid circular dependency)
    // Just pass through the error
    return Promise.reject(error);
  }
);

export default authApiClient;
