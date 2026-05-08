import config from '@/config';

// ─── Types ─────────────────────────────────────────────────────────

export interface CustomerProfile {
  customerId: string;
  customerNumber: string;
  customerType: string;
  customerStatus: string;

  // Personal
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;

  // Business (populated for BUSINESS/CORPORATE)
  businessName?: string;
  businessLegalName?: string;
  businessRegistrationNumber?: string;
  businessRegistrationDate?: string;
  businessType?: string;
  industrySector?: string;
  yearsInBusiness?: number;
  numberOfEmployees?: number;

  // Contact
  primaryEmail?: string;
  secondaryEmail?: string;
  primaryPhone?: string;
  secondaryPhone?: string;
  mobilePhone?: string;
  preferredContactMethod?: string;

  // Address
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;

  // Identity docs
  primaryIdentityType?: string;
  primaryIdentityNumber?: string;
  taxIdNumber?: string;

  // Financial (read-only)
  annualIncome?: number;
  annualRevenue?: number;
  netWorth?: number;

  // Employment
  employmentStatus?: string;
  employerName?: string;
  occupation?: string;

  // Risk / Compliance (read-only)
  creditScore?: number;
  riskRating?: string;
  kycStatus?: string;
  amlCheckStatus?: string;

  // Meta
  customerSince?: string;
  customerSegment?: string;
  displayName?: string;
  age?: number;
  fullAddress?: string;
}

export interface UpdateProfilePayload {
  primaryEmail?: string;
  secondaryEmail?: string;
  primaryPhone?: string;
  secondaryPhone?: string;
  mobilePhone?: string;
  preferredContactMethod?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  employmentStatus?: string;
  employerName?: string;
  occupation?: string;
}

export interface EntityMember {
  id: string;
  entityId: string;
  customerId: string;
  role: string;
  roleTitle?: string;
  ownershipPercentage?: number;
  isActive: boolean;
  isAuthorizedSignatory: boolean;
  isBeneficialOwner: boolean;
  customerName?: string;
  customerEmail?: string;
}

export interface CompanyProfile {
  id: string;
  bankId: string;
  entityType: string;
  status: string;
  legalName: string;
  tradingName?: string;
  registrationNumber?: string;
  registrationCountry?: string;
  registrationDate?: string;
  taxIdNumber?: string;
  vatNumber?: string;
  email?: string;
  phoneNumber?: string;
  website?: string;

  registeredAddressLine1?: string;
  registeredAddressLine2?: string;
  registeredCity?: string;
  registeredCounty?: string;
  registeredEircode?: string;
  registeredCountry?: string;

  tradingAddressLine1?: string;
  tradingAddressLine2?: string;
  tradingCity?: string;
  tradingCounty?: string;
  tradingEircode?: string;
  tradingCountry?: string;

  industrySector?: string;
  businessDescription?: string;
  yearEstablished?: number;
  numberOfEmployees?: number;
  annualTurnover?: number;

  members?: EntityMember[];
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateCompanyPayload {
  tradingName?: string;
  businessDescription?: string;
  email?: string;
  phoneNumber?: string;
  website?: string;
  tradingAddressLine1?: string;
  tradingAddressLine2?: string;
  tradingCity?: string;
  tradingCounty?: string;
  tradingEircode?: string;
  tradingCountry?: string;
}

// ─── API Service ───────────────────────────────────────────────────

const BFF_BASE = config.api.baseUrl; // http://localhost:8087

function authHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem(config.auth.tokenKey) : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const customerService = {
  /** GET /api/customer/me */
  async getMyProfile(): Promise<CustomerProfile> {
    const res = await fetch(`${BFF_BASE}/api/customer/me`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      if (res.status === 404)
        throw { status: 404, message: 'No customer profile linked to your account' };
      throw { status: res.status, message: 'Failed to load profile' };
    }
    return res.json();
  },

  /** PUT /api/customer/me */
  async updateMyProfile(data: UpdateProfilePayload): Promise<CustomerProfile> {
    const res = await fetch(`${BFF_BASE}/api/customer/me`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Update failed' }));
      throw { status: res.status, message: err.message || 'Update failed' };
    }
    return res.json();
  },

  /** GET /api/customer/company */
  async getMyCompany(): Promise<CompanyProfile | null> {
    const res = await fetch(`${BFF_BASE}/api/customer/company`, {
      headers: authHeaders(),
    });
    if (res.status === 204 || res.status === 404) return null;
    if (!res.ok) throw { status: res.status, message: 'Failed to load company profile' };
    return res.json();
  },

  /** PUT /api/customer/company */
  async updateMyCompany(data: UpdateCompanyPayload): Promise<CompanyProfile> {
    const res = await fetch(`${BFF_BASE}/api/customer/company`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Update failed' }));
      throw { status: res.status, message: err.message || 'Update failed' };
    }
    return res.json();
  },
};
