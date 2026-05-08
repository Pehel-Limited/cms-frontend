import { apiClient } from './client';

export interface User {
  userId: string;
  bankId?: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phoneNumber?: string;
  userType?: string;
  status?: string;
  twoFactorEnabled?: boolean;
  lastLoginAt?: string;
  forcePasswordChange?: boolean;
  passwordExpiresAt?: string;
  roles?: string[];
  permissions?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface UsersResponse {
  content: User[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

class UserService {
  private baseUrl = '/api/v1/users';

  async getUsers(params?: {
    search?: string;
    role?: string;
    page?: number;
    size?: number;
    sort?: string;
  }): Promise<UsersResponse> {
    const queryParams = new URLSearchParams();

    if (params?.search) queryParams.append('search', params.search);
    if (params?.role) queryParams.append('role', params.role);
    if (params?.page !== undefined) queryParams.append('page', params.page.toString());
    if (params?.size !== undefined) queryParams.append('size', params.size.toString());
    if (params?.sort) queryParams.append('sort', params.sort);

    const url = `${this.baseUrl}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiClient.get<UsersResponse>(url);
  }

  async getUsersByRole(role: string, search?: string): Promise<User[]> {
    const response = await this.getUsers({ role, search, size: 100 });
    return response.content;
  }

  async getUnderwriters(search?: string): Promise<User[]> {
    // Call the backend endpoint that filters by permission
    const response = await apiClient.get<UsersResponse>(
      `/api/v1/users/underwriters${search ? `?search=${encodeURIComponent(search)}` : ''}`
    );
    return response.content;
  }
}

export const userService = new UserService();
