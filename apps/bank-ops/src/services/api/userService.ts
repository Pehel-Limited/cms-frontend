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

/** A role the administrator can grant, with the permissions it carries. */
export interface RoleOption {
  roleId: string;
  roleType: string;
  roleName: string;
  description: string;
  permissions: string[];
}

export interface CreateBankUserPayload {
  username: string;
  email: string;
  temporaryPassword: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  roleNames: string[];
  forcePasswordChangeOnFirstLogin?: boolean;
}

export type BankUserStatusAction = 'activate' | 'suspend' | 'deactivate';

class UserService {
  private baseUrl = '/api/v1/users';

  async getUsers(params?: {
    search?: string;
    role?: string;
    userType?: string;
    page?: number;
    size?: number;
    sort?: string;
  }): Promise<UsersResponse> {
    const queryParams = new URLSearchParams();

    if (params?.search) queryParams.append('search', params.search);
    if (params?.role) queryParams.append('role', params.role);
    if (params?.userType) queryParams.append('userType', params.userType);
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

  getRoleCatalog(): Promise<RoleOption[]> {
    return apiClient.get<RoleOption[]>('/api/v1/users/roles');
  }

  createBankUser(payload: CreateBankUserPayload): Promise<User> {
    return apiClient.post<User>('/api/v1/users', payload);
  }

  setUserStatus(userId: string, action: BankUserStatusAction): Promise<void> {
    return apiClient.put<void>(`/api/v1/users/${userId}/${action}`, {});
  }

  replaceUserRoles(userId: string, roleNames: string[]): Promise<User> {
    return apiClient.put<User>(`/api/v1/users/${userId}/roles`, { roleNames });
  }
}

export const userService = new UserService();
