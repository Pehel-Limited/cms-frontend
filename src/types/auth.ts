export interface User {
  userId: string;
  bankId: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  userType: 'BANK_USER' | 'CUSTOMER';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_ACTIVATION' | 'LOCKED';
  roles: (Role | string)[]; // Can be Role objects or just role type strings
  lastLoginAt?: string;
  twoFactorEnabled: boolean;
}

export interface Role {
  roleId: string;
  roleName: string;
  roleType: string;
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  bankId?: string;
  bankCode?: string;
  username: string;
  password: string;
}

export interface RegisterBankUserRequest {
  bankId: string;
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  employeeNumber: string;
  jobTitle?: string;
}

export interface RegisterCustomerRequest {
  bankId: string;
  customerId: string;
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface ApiError {
  message: string;
  status: number;
  errors?: Record<string, string[]>;
}
